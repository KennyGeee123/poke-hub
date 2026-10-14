import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/shop/confirmation")({
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s.order === "string" ? s.order.slice(0, 64) : "" }),
  head: () => ({ meta: [{ title: "Order received — PokéVault Pro" }] }),
  component: Confirmation,
});

function Confirmation() {
  const { order } = Route.useSearch();
  return (
    <main className="mx-auto max-w-lg p-6 text-center text-white">
      <h1 className="mb-2 text-2xl font-bold">Thanks, your order is in!</h1>
      {order && <p className="mb-2 text-sm opacity-70">Order #{order.slice(0, 8).toUpperCase()}</p>}
      <p className="mb-6 opacity-80">We'll email you a secure payment link and tracking once it ships.</p>
      <Link to="/shop" className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black">Keep shopping</Link>
    </main>
  );
}
