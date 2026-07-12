export default function DashboardLayout({
  children,
  billingInvoices,
  projectBrief,
  revenueTracker,
}: {
  children: React.ReactNode;
  billingInvoices?: React.ReactNode;
  projectBrief?: React.ReactNode;
  revenueTracker?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Top row: KPI cards (from children/page.tsx) */}
      {children}

      {/* Middle row: Revenue tracker full width */}
      <div className="w-full">{revenueTracker}</div>

      {/* Bottom row: Project brief + Billing invoices */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {projectBrief}
        {billingInvoices}
      </div>
    </div>
  );
}
