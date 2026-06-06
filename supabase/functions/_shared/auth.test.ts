import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type AdminQueryClient, isAuthorizedAdmin } from "./auth.ts";

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

Deno.test("isAuthorizedAdmin: active admin_users member is authorized", async () => {
  const { client, calls } = mockClient({ data: { id: "row-1" }, error: null });
  const ok = await isAuthorizedAdmin(client, {
    id: "user-123",
    user_metadata: {},
  });
  assertEquals(ok, true);
  // verify it queried admin_users by user_id + is_active
  assertEquals(calls.table, "admin_users");
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
  const { client } = mockClient({ data: { id: "x" }, error: null });
  assertEquals(await isAuthorizedAdmin(client, null), false);
  assertEquals(await isAuthorizedAdmin(client, undefined), false);
});
