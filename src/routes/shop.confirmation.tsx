import { createFileRoute, Link } from "@tanstack/react-router";
import { orderCode } from "@/lib/shop/checkout";

export const Route = createFileRoute("/shop/confirmation")({
  validateSearch: (s: Record<string, unknown>) => ({
    order: typeof s.order === "string" ? s.order.slice(0, 64) : "",
    paid: s.paid === "1" || s.paid === 1 ? "1" : "",
  }),
  head: () => ({ meta: [{ title: "Order received — PokéVault Pro" }] }),
  component: Confirmation,
});

function Confirmation() {
  const { order, paid } = Route.useSearch();
  const code = order ? orderCode(order) : "";
  return (
    <main className="mx-auto max-w-lg p-6 text-center text-white">
      <h1 className="mb-2 text-2xl font-bold">{paid ? "Payment received, thank you!" : "Thanks, your order is in!"}</h1>
      {code && <p className="mb-2 text-lg">Order #<span className="font-mono font-bold">{code}</span></p>}
      <p className="mb-6 opacity-80">
        {paid ? "We're preparing your order and will email tracking once it ships." : "We'll email you a secure payment link, then tracking once it ships."} Save your order number to track it anytime.
      </p>
      <div className="flex justify-center gap-2">
        <Link to="/shop/order" search={{ code }} className="rounded-lg bg-white/10 px-4 py-2">Track order</Link>
        <Link to="/shop" className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-black">Keep shopping</Link>
      </div>
    </main>
  );
}
