import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkChange, checkInvite } from "./admin-rules.ts";

Deno.test("checkInvite: tidies a valid invite", () => {
  assertEquals(
    checkInvite({
      email: "  Sonal@UrbanMorph.com ",
      name: " Sonal ",
      notf_role: "viewer",
    }),
    {
      ok: true,
      value: {
        email: "sonal@urbanmorph.com",
        name: "Sonal",
        notf_role: "viewer",
      },
    },
  );
});

Deno.test("checkInvite: refuses a bad email, a missing name, or an unknown role", () => {
  assertEquals(
    checkInvite({ email: "not-an-email", name: "A", notf_role: "admin" }).ok,
    false,
  );
  assertEquals(
    checkInvite({ email: "a@b.org", name: "  ", notf_role: "admin" }).ok,
    false,
  );
  // super_admin is added only with scripts/add-super-admin.sh
  assertEquals(
    checkInvite({ email: "a@b.org", name: "A", notf_role: "super_admin" }).ok,
    false,
  );
  assertEquals(checkInvite({}).ok, false);
});

const caller = { user_id: "me" };
const viewer = { user_id: "them", role: "field_officer", notf_role: "viewer" };

Deno.test("checkChange: an admin may change another admin or viewer", () => {
  assertEquals(checkChange(caller, viewer, { notf_role: "admin" }), null);
  assertEquals(checkChange(caller, viewer, { is_active: false }), null);
  assertEquals(checkChange(caller, viewer, { notf_role: null }), null);
});

Deno.test("checkChange: refuses super admins, yourself, and unknown values", () => {
  const superAdmin = {
    user_id: "boss",
    role: "super_admin",
    notf_role: "admin",
  };
  assertEquals(
    checkChange(caller, superAdmin, { is_active: false })?.includes(
      "add-super-admin.sh",
    ),
    true,
  );
  assertEquals(
    checkChange(caller, { ...viewer, user_id: "me" }, { notf_role: "viewer" })
      ?.includes("your own"),
    true,
  );
  assertEquals(
    typeof checkChange(caller, viewer, { notf_role: "owner" }),
    "string",
  );
  assertEquals(
    typeof checkChange(caller, viewer, { is_active: "yes" }),
    "string",
  );
  assertEquals(typeof checkChange(caller, viewer, {}), "string");
});
