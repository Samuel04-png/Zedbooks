import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Shield, Users, Edit2, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  user_id: string;
  role: AppRole;
  email: string;
  full_name: string | null;
  created_at: string;
}

const ROLE_DESCRIPTIONS: Record<AppRole, { label: string; description: string; color: string }> = {
  super_admin: { label: "Super Admin", description: "Full system access, can manage all users and settings", color: "bg-red-500" },
  admin: { label: "Admin", description: "Can manage most settings and users", color: "bg-orange-500" },
  accountant: { label: "Accountant", description: "Full access to financial records, reports, and transactions", color: "bg-blue-500" },
  finance_officer: { label: "Finance Officer", description: "Can manage invoices, bills, and expenses", color: "bg-cyan-500" },
  bookkeeper: { label: "Bookkeeper", description: "Can record transactions and reconcile accounts", color: "bg-teal-500" },
  inventory_manager: { label: "Inventory Manager", description: "Can manage inventory and stock movements", color: "bg-green-500" },
  hr_manager: { label: "HR Manager", description: "Can manage employees and payroll", color: "bg-purple-500" },
  project_manager: { label: "Project Manager", description: "Can manage projects and grants", color: "bg-indigo-500" },
  auditor: { label: "Auditor", description: "Read-only access to all financial records for auditing", color: "bg-yellow-500" },
  read_only: { label: "Read Only", description: "Can only view data, no editing permissions", color: "bg-gray-500" },
};

const ROLE_ORDER: AppRole[] = [
  "super_admin",
  "admin",
  "accountant",
  "finance_officer",
  "bookkeeper",
  "inventory_manager",
  "hr_manager",
  "project_manager",
  "auditor",
  "read_only",
];

export default function UserManagement() {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("read_only");
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole | null>(null);
  const queryClient = useQueryClient();

  // Check current user's role
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        if (data) {
          setCurrentUserRole(data.role as AppRole);
        }
      }
    };
    checkUserRole();
  }, []);

  // Fetch all users with roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at");

      if (rolesError) throw rolesError;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (profilesError) throw profilesError;

      // Get auth users info via edge function or profiles
      const usersWithRoles: UserWithRole[] = roles.map((role) => {
        const profile = profiles.find((p) => p.id === role.user_id);
        return {
          user_id: role.user_id,
          role: role.role as AppRole,
          email: profile?.full_name || "Unknown",
          full_name: profile?.full_name,
          created_at: role.created_at,
        };
      });

      return usersWithRoles;
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("User role updated successfully");
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error("Failed to update role: " + error.message);
    },
  });

  // Delete user role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("User removed successfully");
    },
    onError: (error) => {
      toast.error("Failed to remove user: " + error.message);
    },
  });

  const canManageUsers = currentUserRole === "super_admin" || currentUserRole === "admin";

  const getRoleBadge = (role: AppRole) => {
    const roleInfo = ROLE_DESCRIPTIONS[role];
    return (
      <Badge className={`${roleInfo.color} text-white`}>
        {roleInfo.label}
      </Badge>
    );
  };

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
                <Button onClick={() => {
                  toast.info("User invitation feature coming soon. For now, users can sign up and admins can assign roles.");
                  setIsInviteOpen(false);
                }}>
                  Send Invitation
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
              {users?.filter((u) => u.role === "accountant" || u.role === "finance_officer" || u.role === "bookkeeper").length || 0}
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  {canManageUsers && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.full_name || "Unknown User"}</span>
                        <span className="text-sm text-muted-foreground">{user.user_id.slice(0, 8)}...</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingUser?.user_id === user.user_id ? (
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
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    {canManageUsers && (
                      <TableCell className="text-right">
                        {editingUser?.user_id === user.user_id ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateRoleMutation.mutate({ userId: user.user_id, newRole: editingUser.role })}
                            >
                              Save
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingUser(user)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Are you sure you want to remove this user's role?")) {
                                  deleteRoleMutation.mutate(user.user_id);
                                }
                              }}
                              disabled={user.role === "super_admin"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(!users || users.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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