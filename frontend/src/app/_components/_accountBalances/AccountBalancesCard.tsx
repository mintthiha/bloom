"use client";
import { useRouter } from "next/navigation";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { Account } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { CollapsibleCard } from "@/components/collapsible-card";

type Props = {
  accounts: Account[];
};

/** Account balances bar chart card — one bar per account, click navigates to account page. */
export function AccountBalancesCard({ accounts }: Props) {
  const router = useRouter();

  const chartData = accounts.map((account) => ({
    id: account.id,
    name: (account.nickname ?? account.ownerName).split(" ")[0],
    balance: account.balance,
    type: account.accountType,
  }));

  return (
    <CollapsibleCard eyebrow="Account Balances" className="fade-up fade-up-1" style={{}}>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#f3f4f6",
            }}
            labelStyle={{ color: "#9ca3af" }}
            itemStyle={{ color: "#f3f4f6" }}
            cursor={{ fill: "#ffffff06" }}
          />
          <Bar
            dataKey="balance"
            radius={[4, 4, 0, 0]}
            onClick={(data) => {
              if (data?.id) router.push(`/account/${data.id}`);
            }}
            style={{ cursor: "pointer" }}
          >
            {chartData.map((account, index) => (
              <Cell key={index} fill={ACCOUNT_TYPE_META[account.type].color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CollapsibleCard>
  );
}
