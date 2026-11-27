"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { placeOrder } from "../actions";

export function CheckoutForm({ defaultEmail, defaultName }: { defaultEmail: string; defaultName: string }) {
  const [state, action] = useActionState(placeOrder, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-semibold">收货信息</h2>
      <FormError message={state?.error} />
      <Field label="邮箱" name="email" type="email" defaultValue={defaultEmail} errors={fe.email} required autoComplete="email" />
      <Field label="收件人" name="shippingName" defaultValue={defaultName} errors={fe.shippingName} required autoComplete="name" />
      <Field label="详细地址" name="shippingAddress" errors={fe.shippingAddress} required autoComplete="street-address" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="城市" name="shippingCity" errors={fe.shippingCity} required autoComplete="address-level2" />
        <Field label="邮编" name="shippingPostal" errors={fe.shippingPostal} required autoComplete="postal-code" />
      </div>
      <Field label="国家/地区" name="shippingCountry" defaultValue="United States" errors={fe.shippingCountry} required autoComplete="country-name" />
      <SubmitButton pendingText="正在下单…" className="w-full">提交订单并支付</SubmitButton>
    </form>
  );
}
