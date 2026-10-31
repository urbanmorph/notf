import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type AdminQueryClient,
  getNotfRole,
  isAuthorizedAdmin,
} from "./auth.ts";

// Build a mock admin client whose admin_users lookup resolves to the given
// result, and that records the filters it was called with.
function mockClient(
  result: { data: unknown; error: unknown },
): { client: AdminQueryClient; calls: Record<string, unknown> } {
  const calls: Record<string, unknown> = {};
  const client: AdminQueryClient = {
    from(table: string) {
      calls.table = table;
      return {
        select(columns: string) {
          calls.columns = columns;
          return {
            eq(col1: string, val1: unknown) {
              calls.eq1 = [col1, val1];
              return {
                eq(col2: string, val2: unknown) {
                  calls.eq2 = [col2, val2];
                  return {
                    maybeSingle() {
                      calls.maybeSingleCalled = true;
                      return Promise.resolve(result);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

Deno.test("isAuthorizedAdmin: an active NOTF admin is authorized", async () => {
  const { client, calls } = mockClient({
    data: { notf_role: "admin" },
    error: null,
  });
  const ok = await isAuthorizedAdmin(client, {
    id: "user-123",
    user_metadata: {},
  });
  assertEquals(ok, true);
  // verify it queried admin_users by user_id + is_active
  assertEquals(calls.table, "admin_users");
  assertEquals(calls.columns, "notf_role");
  assertEquals(calls.eq1, ["user_id", "user-123"]);
  assertEquals(calls.eq2, ["is_active", true]);
});

Deno.test("isAuthorizedAdmin: legacy user_metadata.role==='admin' is authorized without a DB lookup", async () => {
  const { client, calls } = mockClient({ data: null, error: null });
  const ok = await isAuthorizedAdmin(client, {
    id: "user-123",
    user_metadata: { role: "admin" },
  });
  assertEquals(ok, true);
  // short-circuited: no admin_users query
  assertEquals(calls.maybeSingleCalled, undefined);
});

Deno.test("isAuthorizedAdmin: non-member without metadata role is denied", async () => {
  const { client } = mockClient({ data: null, error: null });
  const ok = await isAuthorizedAdmin(client, {
    id: "user-999",
    user_metadata: {},
  });
  assertEquals(ok, false);
});

Deno.test("isAuthorizedAdmin: inactive member (no row returned) is denied", async () => {
  // is_active=true filter means an inactive admin returns data:null
  const { client } = mockClient({ data: null, error: null });
  const ok = await isAuthorizedAdmin(client, { id: "user-inactive" });
  assertEquals(ok, false);
});

Deno.test("isAuthorizedAdmin: a query error fails closed (denied)", async () => {
  const { client } = mockClient({ data: null, error: { message: "boom" } });
  const ok = await isAuthorizedAdmin(client, { id: "user-123" });
  assertEquals(ok, false);
});

Deno.test("isAuthorizedAdmin: null/undefined user is denied", async () => {
  const { client } = mockClient({ data: { notf_role: "admin" }, error: null });
  assertEquals(await isAuthorizedAdmin(client, null), false);
  assertEquals(await isAuthorizedAdmin(client, undefined), false);
});

Deno.test("isAuthorizedAdmin: a NOTF viewer may not write", async () => {
  const { client } = mockClient({ data: { notf_role: "viewer" }, error: null });
  assertEquals(await isAuthorizedAdmin(client, { id: "user-viewer" }), false);
});

Deno.test("isAuthorizedAdmin: an active city-app admin without a NOTF role is denied", async () => {
  const { client } = mockClient({ data: { notf_role: null }, error: null });
  assertEquals(await isAuthorizedAdmin(client, { id: "user-city" }), false);
});

Deno.test("getNotfRole: returns admin, viewer or null, failing closed", async () => {
  for (const role of ["admin", "viewer"]) {
    const { client } = mockClient({ data: { notf_role: role }, error: null });
    assertEquals(await getNotfRole(client, { id: "u" }), role);
  }
  const unknown = mockClient({ data: { notf_role: "owner" }, error: null });
  assertEquals(await getNotfRole(unknown.client, { id: "u" }), null);
  const none = mockClient({ data: null, error: null });
  assertEquals(await getNotfRole(none.client, { id: "u" }), null);
  const failed = mockClient({ data: null, error: { message: "boom" } });
  assertEquals(await getNotfRole(failed.client, { id: "u" }), null);
  assertEquals(await getNotfRole(none.client, null), null);
});
