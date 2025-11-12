// Config local-only + pago demo
window.KG_CONFIG = {
  roles: {
    admin: { password: "admin123" },
    staff: { password: "empleado123" }
  },
  payments: {
    mode: "demo",
    stripe_payment_link_url: ""
  },
  supabase: { url: "", anonKey: "" }
};
