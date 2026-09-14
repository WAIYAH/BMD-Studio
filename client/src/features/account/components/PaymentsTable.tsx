import type { DashboardPayment } from '@bmd/shared';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, shillings } from '../format';
import { PAYMENT_PROVIDER, PAYMENT_PURPOSE, PAYMENT_STATUS } from '../labels';

export function PaymentsTable({
  payments,
  caption,
}: {
  payments: DashboardPayment[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Date
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Payment
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Method
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {payments.map((payment) => {
            const status = PAYMENT_STATUS[payment.status];
            return (
              <tr key={payment.id}>
                <td className="whitespace-nowrap px-5 py-3 text-ink-700">
                  {formatDate(payment.paidAt ?? payment.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <p className="font-semibold text-ink-950">{PAYMENT_PURPOSE[payment.purpose]}</p>
                  <p className="font-mono text-xs text-ink-500">
                    {payment.receiptNumber ?? payment.reference}
                  </p>
                </td>
                <td className="px-5 py-3 text-ink-700">{PAYMENT_PROVIDER[payment.provider]}</td>
                <td className="px-5 py-3">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-ink-950">
                  {shillings(payment.amountCents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
