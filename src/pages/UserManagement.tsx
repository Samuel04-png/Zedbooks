import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Shield, Users, Edit2, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { companyService, type CompanyUserSummary } from "@/services/firebase/companyService";
import { authService } from "@/services/firebase/authService";
import { useUserRole } from "@/hooks/useUserRole";
import type { AppRole } from "@/services/firebase/types";

const ROLE_DESCRIPTIONS: Record<AppRole, { label: string; description: string; color: string }> = {
  super_admin: { label: "Super Admin", description: "Full system access, can manage all users and settings", color: "bg-red-500" },
  admin: { label: "Admin", description: "Can manage most settings and users", color: "bg-orange-500" },
  financial_manager: { label: "Financial Manager", description: "Oversees all financial operations and approvals", color: "bg-rose-500" },
  accountant: { label: "Accountant", description: "Full access to financial records, reports, and transactions", color: "bg-blue-500" },
  assistant_accountant: { label: "Assistant Accountant", description: "Assists with bookkeeping and data entry under supervision", color: "bg-sky-500" },
  finance_officer: { label: "Finance Officer", description: "Can manage invoices, bills, and expenses", color: "bg-cyan-500" },
  bookkeeper: { label: "Bookkeeper", description: "Can record transactions and reconcile accounts", color: "bg-teal-500" },
  cashier: { label: "Cashier", description: "Handles cash transactions and petty cash management", color: "bg-emerald-500" },
  inventory_manager: { label: "Inventory Manager", description: "Can manage inventory and stock movements", color: "bg-green-500" },
  hr_manager: { label: "HR Manager", description: "Can manage employees and payroll", color: "bg-purple-500" },
  project_manager: { label: "Project Manager", description: "Can manage projects and grants", color: "bg-indigo-500" },
  auditor: { label: "Auditor", description: "Read-only access to all financial records for auditing", color: "bg-yellow-500" },
  staff: { label: "Staff", description: "Basic access for regular employees", color: "bg-slate-500" },
  read_only: { label: "Read Only", description: "Can only view data, no editing permissions", color: "bg-gray-500" },
};

const ROLE_ORDER: AppRole[] = [
  "super_admin",
  "admin",
  "financial_manager",
  "accountant",
  "assistant_accountant",
  "finance_officer",
  "bookkeeper",
  "cashier",
  "inventory_manager",
  "hr_manager",
  "project_manager",
  "auditor",
  "staff",
  "read_only",
];

export default function UserManagement() {
  const { user } = useAuth();
  const { data: currentUserRole } = useUserRole();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("finance_officer");
  const [editingUser, setEditingUser] = useState<CompanyUserSummary | null>(null);

  // We need to fetch the current user's primary company ID to list users
  const { data: primaryMembership } = useQuery({
    queryKey: ["primary-membership", user?.uid],
    queryFn: () => user ? companyService.getPrimaryMembershipByUser(user.uid) : null,
    enabled: !!user,
  });

  const companyId = primaryMembership?.companyId;
  const queryClient = useQueryClient();

  // Fetch all users with roles
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return companyService.listCompanyUsers(companyId);
    },
    enabled: !!companyId,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      if (!companyId) throw new Error("No company ID found");
      await companyService.updateUserRole({ companyId, userId, newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      toast.success("User role updated successfully");
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error("Failed to update role: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!companyId) throw new Error("No company ID found");
      await companyService.removeCompanyUser({ companyId, userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      toast.success("User removed successfully");
    },
    onError: (error) => {
      toast.error("Failed to remove user: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Suspend/Reactivate mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'suspend' | 'reactivate' }) => {
      if (!companyId) throw new Error("No company ID found");
      if (action === 'suspend') {
        await companyService.suspendUser({ companyId, userId });
      } else {
        await companyService.reactivateUser({ companyId, userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      toast.success("User status updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  // Revoke invitation
  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!companyId) throw new Error("No company ID found");
      await companyService.revokeInvitation({ companyId, invitationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      toast.success("Invitation revoked");
    },
    onError: (error) => {
      toast.error("Failed to revoke: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteEmail) throw new Error("Email is required");
      if (!companyId) throw new Error("No company ID found");

      await authService.sendInvitation({
        email: inviteEmail,
        role: inviteRole,
        inviteeName: inviteName,
        companyId,
        loginUrl: `${window.location.origin}/auth`,
      });
    },
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      setInviteEmail("");
      setInviteName("");
      setInviteRole("finance_officer");
      setIsInviteOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to send invite: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  const canManageUsers = currentUserRole === "super_admin" || currentUserRole === "admin";

  const getRoleBadge = (role: AppRole) => {
    const roleInfo = ROLE_DESCRIPTIONS[role];
    return (
      <Badge className={`${roleInfo.color} text-white hover:${roleInfo.color}`}>
        {roleInfo.label}
      </Badge>
    );
  };

  const displayName = (user: CompanyUserSummary) => {
    return user.fullName || user.email || user.userId || "Unknown User";
  };

  if (!user || (!companyId && !isLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-muted-foreground">
            Manage user access and permissions like QuickBooks
          </p>
        </div>
        {canManageUsers && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new user with a specific role
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Doe"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_ORDER.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <span>{ROLE_DESCRIPTIONS[role].label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_DESCRIPTIONS[inviteRole].description}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Invitation"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Role Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users?.filter((u) => u.role === "super_admin" || u.role === "admin").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accountants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users?.filter((u) => ["accountant", "finance_officer", "bookkeeper"].includes(u.role)).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentUserRole && getRoleBadge(currentUserRole)}
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage user roles and permissions across your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-4 text-red-500 text-center">
              Failed to load users. Please try again.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  {canManageUsers && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{displayName(user)}</span>
                        {user.email && (
                          <span className="text-sm text-muted-foreground">{user.email}</span>
                        )}
                        {/* Show invitation marker */}
                        {user.status === 'invited' && (
                          <span className="text-xs text-amber-500 font-mono">Invitation Pending</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingUser?.id === user.id && user.status !== 'invited' ? (
                        <Select
                          value={editingUser.role}
                          onValueChange={(v) => setEditingUser({ ...editingUser, role: v as AppRole })}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_ORDER.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_DESCRIPTIONS[role].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-1">
                          {getRoleBadge(user.role)}
                          <p className="text-xs text-muted-foreground">
                            {ROLE_DESCRIPTIONS[user.role].description}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "default" : user.status === "invited" ? "outline" : "destructive"}>
                        {user.status === 'invited' ? 'Pending' : user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                    </TableCell>
                    {canManageUsers && (
                      <TableCell className="text-right">
                        {editingUser?.id === user.id ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateRoleMutation.mutate({ userId: user.userId, newRole: editingUser.role })}
                              disabled={updateRoleMutation.isPending}
                            >
                              {updateRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingUser(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            {/* Actions for Invites */}
                            {user.status === 'invited' ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm("Revoke this invitation? The link will no longer work.")) {
                                    revokeMutation.mutate(user.id);
                                  }
                                }}
                                disabled={revokeMutation.isPending}
                              >
                                Revoke
                              </Button>
                            ) : (
                              <>
                                {/* Actions for Active/Suspended Users */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingUser(user)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>

                                {user.status === 'suspended' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => toggleStatusMutation.mutate({ userId: user.userId, action: 'reactivate' })}
                                    disabled={toggleStatusMutation.isPending}
                                  >
                                    Activate
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    onClick={() => {
                                      if (confirm("Suspend this user? They will lose access immediately.")) {
                                        toggleStatusMutation.mutate({ userId: user.userId, action: 'suspend' });
                                      }
                                    }}
                                    disabled={toggleStatusMutation.isPending || user.role === 'super_admin'}
                                  >
                                    Suspend
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm("Permanently remove this user? This cannot be undone.")) {
                                      removeUserMutation.mutate(user.userId);
                                    }
                                  }}
                                  disabled={user.role === "super_admin" || removeUserMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(!users || users.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions Reference</CardTitle>
          <CardDescription>
            Understanding what each role can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {ROLE_ORDER.map((role) => (
              <div key={role} className="flex items-start gap-3 p-3 rounded-lg border">
                {getRoleBadge(role)}
                <div>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role].description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
