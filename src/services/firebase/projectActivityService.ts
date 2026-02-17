import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  type QueryConstraint,
  where,
} from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  readBoolean,
  readString,
  readValue,
} from "@/components/dashboard/dashboardDataUtils";

export type ProjectProgressStatus = "in_progress" | "behind" | "on_track" | "completed";

export const PROJECT_PHASES = [
  "Initiation",
  "Planning",
  "Design",
  "Execution",
  "Monitoring",
  "Closing",
] as const;

export interface ProjectActivityLog {
  id: string;
  companyId: string;
  projectId: string;
  activity: string;
  description: string;
  source: string;
  sourceType: string | null;
  sourceId: string | null;
  role: string | null;
  assignedTo: string | null;
  phase: string | null;
  discipline: string | null;
  approvalStatus: string | null;
  appliedToSection: string | null;
  status: string | null;
  milestoneName: string | null;
  milestoneAchieved: boolean;
  implemented: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface CreateProjectActivityInput {
  companyId: string;
  projectId: string;
  activity: string;
  description?: string | null;
  source?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  role?: string | null;
  assignedTo?: string | null;
  phase?: string | null;
  discipline?: string | null;
  approvalStatus?: string | null;
  appliedToSection?: string | null;
  status?: string | null;
  milestoneName?: string | null;
  milestoneAchieved?: boolean;
  implemented?: boolean;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProjectProgressMetrics {
  completedActivities: number;
  totalActivities: number;
  approvedSections: number;
  totalSections: number;
  milestonesAchieved: number;
  totalMilestones: number;
  pendingCount: number;
  implementedCount: number;
}

export interface ProjectProgressSummary {
  projectId: string;
  currentPhase: string;
  completion: number;
  status: ProjectProgressStatus;
  metrics: ProjectProgressMetrics;
}

type ProjectLike = Record<string, unknown> & { id: string };

const COMPLETED_STATUSES = new Set(["approved", "implemented", "completed", "done"]);
const IMPLEMENTED_STATUSES = new Set(["approved", "implemented", "completed", "done"]);
const PENDING_STATUSES = new Set(["pending", "todo", "open", "in_progress", "inprogress"]);

const normalizeToken = (value: string) => value.trim().toLowerCase().replace(/[\s_-]/g, "");

const normalizeStatus = (value: string | null | undefined): string =>
  value ? normalizeToken(value) : "";

const cleanString = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const titleCase = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");

const toIsoDateTime = (value: unknown): string => {
  if (!value) return new Date(0).toISOString();
  if (typeof value === "string") {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? new Date(0).toISOString() : asDate.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString();
    }
  }
  return new Date(0).toISOString();
};

const parseDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const readFromTopOrDetails = (
  row: Record<string, unknown>,
  details: Record<string, unknown> | null,
  keys: string[],
  fallback = "",
): string => {
  const top = readString(row, keys, "");
  if (top) return top;
  if (details) {
    const nested = readString(details, keys, "");
    if (nested) return nested;
  }
  return fallback;
};

const normalizeActivityRow = (
  id: string,
  row: Record<string, unknown>,
): ProjectActivityLog | null => {
  const details = (readValue(row, ["details"], null) as Record<string, unknown> | null) ?? null;

  const companyId = readFromTopOrDetails(row, details, ["companyId", "company_id"]);
  const projectId = readFromTopOrDetails(row, details, ["projectId", "project_id"]);
  if (!companyId || !projectId) return null;

  const action = readFromTopOrDetails(row, details, ["action", "event"], "Activity");
  const activity = readFromTopOrDetails(row, details, ["activity", "title"], action || "Activity");
  const description = readFromTopOrDetails(row, details, ["description", "notes"], "");
  const source = readFromTopOrDetails(
    row,
    details,
    ["source", "sourceType", "source_type", "sourceCollection", "source_collection", "tableName", "table_name"],
    "-",
  );
  const sourceType = cleanString(
    readFromTopOrDetails(row, details, ["sourceType", "source_type", "sourceCollection", "source_collection"]),
  );
  const sourceId = cleanString(readFromTopOrDetails(row, details, ["sourceId", "source_id", "recordId", "record_id"]));
  const role = cleanString(readFromTopOrDetails(row, details, ["role", "actorRole", "actor_role"]));
  const assignedTo = cleanString(readFromTopOrDetails(row, details, ["assignedTo", "assigned_to", "assignee"]));
  const phase = cleanString(readFromTopOrDetails(row, details, ["phase", "currentPhase", "current_phase", "stage"]));
  const discipline = cleanString(readFromTopOrDetails(row, details, ["discipline"]));
  const approvalStatus = cleanString(readFromTopOrDetails(row, details, ["approvalStatus", "approval_status"]));
  const appliedToSection = cleanString(
    readFromTopOrDetails(row, details, ["appliedToSection", "applied_to_section", "section"]),
  );
  const status = cleanString(readFromTopOrDetails(row, details, ["status"]));
  const milestoneName = cleanString(
    readFromTopOrDetails(row, details, ["milestoneName", "milestone_name", "milestone"]),
  );
  const milestoneAchieved = readBoolean(row, ["milestoneAchieved", "milestone_achieved"], false)
    || (details ? readBoolean(details, ["milestoneAchieved", "milestone_achieved"], false) : false);
  const implemented = readBoolean(row, ["implemented", "isImplemented", "is_implemented"], false)
    || (details ? readBoolean(details, ["implemented", "isImplemented", "is_implemented"], false) : false);

  return {
    id,
    companyId,
    projectId,
    activity,
    description,
    source,
    sourceType,
    sourceId,
    role,
    assignedTo,
    phase,
    discipline,
    approvalStatus,
    appliedToSection,
    status,
    milestoneName,
    milestoneAchieved,
    implemented,
    createdBy: cleanString(
      readFromTopOrDetails(row, details, ["createdBy", "created_by", "userId", "user_id", "actorUid", "actor_uid"]),
    ),
    createdAt: toIsoDateTime(readValue(row, ["createdAt", "created_at"])),
    updatedAt: toIsoDateTime(readValue(row, ["updatedAt", "updated_at", "createdAt", "created_at"])),
    metadata: (readValue(row, ["metadata"], null) as Record<string, unknown> | null) ?? null,
  };
};

const isCompletedLog = (log: ProjectActivityLog): boolean => {
  const status = normalizeStatus(log.status);
  const approvalStatus = normalizeStatus(log.approvalStatus);

  return (
    COMPLETED_STATUSES.has(status)
    || COMPLETED_STATUSES.has(approvalStatus)
    || log.implemented
    || log.milestoneAchieved
  );
};

const derivePhase = (
  project: ProjectLike,
  logs: ProjectActivityLog[],
  completion: number,
): string => {
  const explicitPhase = cleanString(
    readString(project, ["currentPhase", "current_phase", "phase", "stage"], ""),
  );
  if (explicitPhase) return titleCase(explicitPhase);

  const loggedPhase = logs.find((log) => log.phase)?.phase;
  if (loggedPhase) return titleCase(loggedPhase);

  if (completion >= 90) return "Closing";
  if (completion >= 65) return "Execution";
  if (completion >= 40) return "Design";
  if (completion >= 20) return "Planning";
  return "Initiation";
};

const deriveProgressStatus = (
  project: ProjectLike,
  completion: number,
  pendingCount: number,
  implementedCount: number,
): ProjectProgressStatus => {
  const projectStatus = normalizeStatus(readString(project, ["status"], ""));
  const hasSufficientSignals = pendingCount + implementedCount >= 4;

  if (projectStatus === "completed" || (completion >= 100 && hasSufficientSignals)) {
    return "completed";
  }

  const startDate = parseDate(cleanString(readString(project, ["startDate", "start_date"], "")));
  const endDate = parseDate(cleanString(readString(project, ["endDate", "end_date"], "")));
  let expectedProgress: number | null = null;
  if (startDate && endDate && endDate.getTime() > startDate.getTime()) {
    const now = Date.now();
    if (now <= startDate.getTime()) {
      expectedProgress = 0;
    } else if (now >= endDate.getTime()) {
      expectedProgress = 100;
    } else {
      expectedProgress = ((now - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100;
    }
  }

  if (expectedProgress !== null && completion + 10 < expectedProgress) {
    return "behind";
  }
  if (expectedProgress !== null && completion >= expectedProgress - 8) {
    return "on_track";
  }
  if (implementedCount > 0 && implementedCount >= pendingCount) {
    return "on_track";
  }

  return "in_progress";
};

export const computeProjectProgress = (
  project: ProjectLike,
  projectLogs: ProjectActivityLog[],
): ProjectProgressSummary => {
  const trackableLogs = projectLogs.filter((log) =>
    Boolean(
      log.status
      || log.approvalStatus
      || log.implemented
      || log.milestoneName
      || log.milestoneAchieved,
    ));
  const logsForActivity = trackableLogs.length ? trackableLogs : projectLogs;

  const completedActivities = logsForActivity.filter(isCompletedLog).length;
  const totalActivities = logsForActivity.length;

  const sections = new Set(
    projectLogs
      .map((log) => cleanString(log.appliedToSection))
      .filter((value): value is string => Boolean(value)),
  );
  const approvedSections = new Set(
    projectLogs
      .filter((log) => normalizeStatus(log.approvalStatus) === "approved")
      .map((log) => cleanString(log.appliedToSection))
      .filter((value): value is string => Boolean(value)),
  );

  const milestoneLogs = projectLogs.filter((log) =>
    Boolean(
      log.milestoneName
      || log.milestoneAchieved
      || /milestone/i.test(log.activity)
      || /milestone/i.test(log.description),
    ));
  const milestoneKey = (log: ProjectActivityLog) =>
    cleanString(log.milestoneName) || cleanString(log.appliedToSection) || cleanString(log.activity) || log.id;
  const milestones = new Set(
    milestoneLogs.map(milestoneKey).filter((value): value is string => Boolean(value)),
  );
  const achievedMilestones = new Set(
    milestoneLogs
      .filter((log) => log.milestoneAchieved || isCompletedLog(log))
      .map(milestoneKey)
      .filter((value): value is string => Boolean(value)),
  );

  const implementedCount = projectLogs.filter((log) =>
    IMPLEMENTED_STATUSES.has(normalizeStatus(log.status)),
  ).length;
  const pendingCount = projectLogs.filter((log) =>
    PENDING_STATUSES.has(normalizeStatus(log.status))
    || normalizeStatus(log.approvalStatus) === "pending",
  ).length;

  const projectStatus = normalizeStatus(readString(project, ["status"], ""));
  const isCompletedProject = projectStatus === "completed";

  const activityRatio = totalActivities > 0 ? completedActivities / totalActivities : isCompletedProject ? 1 : 0;
  const sectionRatio = sections.size > 0 ? approvedSections.size / sections.size : 0;
  const milestoneRatio = milestones.size > 0 ? achievedMilestones.size / milestones.size : 0;
  const implementationDenominator = implementedCount + pendingCount;
  const implementationRatio = implementationDenominator > 0 ? implementedCount / implementationDenominator : 0;

  const weighted = [
    { ratio: activityRatio, weight: 0.4, enabled: totalActivities > 0 || isCompletedProject },
    { ratio: sectionRatio, weight: 0.2, enabled: sections.size > 0 },
    { ratio: milestoneRatio, weight: 0.2, enabled: milestones.size > 0 },
    { ratio: implementationRatio, weight: 0.2, enabled: implementationDenominator > 0 },
  ];
  const activeWeight = weighted.filter((item) => item.enabled).reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = weighted
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + item.ratio * item.weight, 0);

  let completion = activeWeight > 0 ? (weightedScore / activeWeight) * 100 : 0;
  if (isCompletedProject) completion = 100;
  if (!isCompletedProject) {
    const signalCount = Math.max(totalActivities, implementationDenominator, sections.size, milestones.size);
    if (signalCount <= 1) {
      completion = Math.min(completion, 20);
    } else if (signalCount === 2) {
      completion = Math.min(completion, 45);
    }
  }
  completion = Math.max(0, Math.min(100, Math.round(completion)));

  const currentPhase = derivePhase(project, projectLogs, completion);
  const status = deriveProgressStatus(project, completion, pendingCount, implementedCount);

  return {
    projectId: project.id,
    currentPhase,
    completion,
    status,
    metrics: {
      completedActivities,
      totalActivities,
      approvedSections: approvedSections.size,
      totalSections: sections.size,
      milestonesAchieved: achievedMilestones.size,
      totalMilestones: milestones.size,
      pendingCount,
      implementedCount,
    },
  };
};

export const computeProjectProgressMap = (
  projects: ProjectLike[],
  logs: ProjectActivityLog[],
): Map<string, ProjectProgressSummary> => {
  const logsByProject = new Map<string, ProjectActivityLog[]>();

  logs.forEach((log) => {
    if (!logsByProject.has(log.projectId)) {
      logsByProject.set(log.projectId, []);
    }
    logsByProject.get(log.projectId)?.push(log);
  });

  return new Map(
    projects.map((project) => [
      project.id,
      computeProjectProgress(project, logsByProject.get(project.id) ?? []),
    ]),
  );
};

export const projectActivityService = {
  async listByCompany(companyId: string, options?: { limitCount?: number }): Promise<ProjectActivityLog[]> {
    const constraints: QueryConstraint[] = [where("companyId", "==", companyId)];
    if (options?.limitCount && options.limitCount > 0) {
      constraints.push(limit(options.limitCount));
    }
    const snapshot = await getDocs(query(collection(firestore, COLLECTIONS.PROJECT_ACTIVITY_LOGS), ...constraints));
    return snapshot.docs
      .map((docSnap) => normalizeActivityRow(docSnap.id, docSnap.data() as Record<string, unknown>))
      .filter((log): log is ProjectActivityLog => Boolean(log))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listByProject(
    companyId: string,
    projectId: string,
    options?: { limitCount?: number },
  ): Promise<ProjectActivityLog[]> {
    const constraints: QueryConstraint[] = [
      where("companyId", "==", companyId),
      where("projectId", "==", projectId),
    ];
    if (options?.limitCount && options.limitCount > 0) {
      constraints.push(limit(options.limitCount));
    }

    const snapshot = await getDocs(query(collection(firestore, COLLECTIONS.PROJECT_ACTIVITY_LOGS), ...constraints));
    return snapshot.docs
      .map((docSnap) => normalizeActivityRow(docSnap.id, docSnap.data() as Record<string, unknown>))
      .filter((log): log is ProjectActivityLog => Boolean(log))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(input: CreateProjectActivityInput): Promise<void> {
    const activity = cleanString(input.activity);
    if (!activity) return;

    await addDoc(collection(firestore, COLLECTIONS.PROJECT_ACTIVITY_LOGS), {
      companyId: input.companyId,
      projectId: input.projectId,
      activity,
      description: cleanString(input.description) ?? null,
      source: cleanString(input.source) ?? "Project Workspace",
      sourceType: cleanString(input.sourceType) ?? null,
      sourceId: cleanString(input.sourceId) ?? null,
      role: cleanString(input.role) ?? null,
      assignedTo: cleanString(input.assignedTo) ?? null,
      phase: cleanString(input.phase) ?? null,
      discipline: cleanString(input.discipline) ?? null,
      approvalStatus: cleanString(input.approvalStatus) ?? null,
      appliedToSection: cleanString(input.appliedToSection) ?? null,
      status: cleanString(input.status) ?? "implemented",
      milestoneName: cleanString(input.milestoneName) ?? null,
      milestoneAchieved: Boolean(input.milestoneAchieved),
      implemented: input.implemented ?? true,
      createdBy: cleanString(input.createdBy) ?? null,
      metadata: input.metadata ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  getProjectHealthStats(logs: ProjectActivityLog[]) {
    const pendingCount = logs.filter((log) => normalizeStatus(log.status) === "pending").length;
    const implementedCount = logs.filter((log) =>
      IMPLEMENTED_STATUSES.has(normalizeStatus(log.status)),
    ).length;
    const approvedCount = logs.filter((log) => normalizeStatus(log.approvalStatus) === "approved").length;
    const completion = logs.length
      ? Math.round((implementedCount + approvedCount) / Math.max(logs.length, 1) * 100)
      : 0;

    return {
      pendingCount,
      implementedCount,
      approvedCount,
      completion: Math.min(100, Math.max(0, completion)),
      lastUpdatedAt: logs[0]?.createdAt ?? null,
      totalItems: logs.length,
    };
  },
};
