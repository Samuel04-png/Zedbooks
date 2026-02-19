import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryConstraint,
  type WhereFilterOp,
} from "firebase/firestore";
import { assertFirebaseConfigured, firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { companyService } from "@/services/firebase/companyService";

export interface DashboardFilter {
  field: string;
  op: WhereFilterOp;
  value: unknown;
}

export interface DashboardQueryRequest {
  collectionName: string;
  filters?: DashboardFilter[];
  orderByField?: string;
  orderDirection?: "asc" | "desc";
  limitCount?: number;
}

type DashboardQueryMap = Record<string, DashboardQueryRequest>;
type DashboardResultMap<T extends DashboardQueryMap> = {
  [K in keyof T]: Array<Record<string, unknown> & { id: string }>;
};

const ALLOWED_COLLECTIONS = new Set<string>(Object.values(COLLECTIONS));

const assertAllowedCollectionName = (collectionName: string) => {
  if (!ALLOWED_COLLECTIONS.has(collectionName)) {
    throw new Error(`Dashboard query rejected for unknown collection: ${collectionName}`);
  }
};

const buildQueryConstraints = (companyId: string, request: DashboardQueryRequest): QueryConstraint[] => {
  const constraints: QueryConstraint[] = [where("companyId", "==", companyId)];

  request.filters?.forEach((filter) => {
    constraints.push(where(filter.field, filter.op, filter.value));
  });

  if (request.orderByField) {
    constraints.push(orderBy(request.orderByField, request.orderDirection ?? "desc"));
  }

  if (typeof request.limitCount === "number" && request.limitCount > 0) {
    constraints.push(limit(request.limitCount));
  }

  return constraints;
};

const runDashboardQuery = async (
  companyId: string,
  request: DashboardQueryRequest,
): Promise<Array<Record<string, unknown> & { id: string }>> => {
  assertAllowedCollectionName(request.collectionName);
  const constraints = buildQueryConstraints(companyId, request);
  const snapshot = await getDocs(query(collection(firestore, request.collectionName), ...constraints));

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Record<string, unknown>),
  }));
};

export const dashboardService = {
  async getCompanyIdForUser(userId: string): Promise<string> {
    assertFirebaseConfigured();

    const membership = await companyService.getPrimaryMembershipByUser(userId);
    if (!membership?.companyId) {
      throw new Error("No active company membership found for this user.");
    }

    return membership.companyId;
  },

  async runQuery(userId: string, request: DashboardQueryRequest) {
    const companyId = await this.getCompanyIdForUser(userId);
    return runDashboardQuery(companyId, request);
  },

  async runQueries<T extends DashboardQueryMap>(userId: string, requests: T): Promise<DashboardResultMap<T>> {
    const companyId = await this.getCompanyIdForUser(userId);
    const entries = Object.entries(requests) as Array<[keyof T, T[keyof T]]>;
    const results = await Promise.all(
      entries.map(async ([key, request]) => {
        const data = await runDashboardQuery(companyId, request);
        return [key, data] as const;
      }),
    );

    return Object.fromEntries(results) as DashboardResultMap<T>;
  },
};
