import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { Thread } from "@copilotkit/channels";
import { z } from "zod";
// The pinned SDK fixture exercises managed delivery without accounts or network.
import { DeliveryTestGateway } from "../../../../node_modules/@copilotkit/channels-intelligence/dist/delivery-test-gateway.js";
export { preparedDelivery } from "../../../../node_modules/@copilotkit/channels-intelligence/dist/delivery-test-gateway.js";

// The SDK fixture predates the required stable providerMessageId ack field.
export class ManagedGateway extends DeliveryTestGateway {
  /**
   * The SDK fixture gives a delivery 1 s to close, enough for the scripted
   * reviewer, not for a real model turn (several tool calls, each a model
   * round trip). Model-mode replays pass a longer deadline.
   */
  constructor(private readonly options: { deliverTimeoutMs?: number } = {}) {
    super();
  }

  override async deliver(delivery: Parameters<DeliveryTestGateway["deliver"]>[0]): Promise<void> {
    const timeoutMs = this.options.deliverTimeoutMs ?? 1_000;
    // The fixture declares these private; the loop below is its deliver() verbatim.
    const self = this as unknown as {
      leaves: number;
      currentDelivery: unknown;
      invitationHandler?: (invitation: Record<string, unknown>) => void;
    };
    const expectedLeaves = self.leaves + 1;
    self.currentDelivery = delivery;
    self.invitationHandler?.({
      protocol: "channel_delivery_v1",
      deliveryId: delivery.deliveryId,
      canonicalThreadId: delivery.canonicalThreadId,
      channelName: delivery.channelName,
      adapter: delivery.adapter,
    });
    const deadline = Date.now() + timeoutMs;
    while (self.leaves !== expectedLeaves) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for delivery topic to close (${timeoutMs} ms)`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  override async join(topic: string, payload: unknown) {
    const channel = await super.join(topic, payload);
    return {
      ...channel,
      push: async (event: string, packet: unknown) => {
        const ack = z
          .object({ result: z.record(z.string(), z.unknown()) })
          .passthrough()
          .parse(await channel.push(event, packet));
        return {
          ...ack,
          result: {
            ...ack.result,
            providerMessageId:
              `pid_v1_${createHash("sha256").update(String(ack.result.providerReference)).digest("base64url")}`,
          },
        };
      },
    };
  }
}

export function concreteThread(value: unknown): Thread {
  // createChannel's StatefulThread type narrows state() incompatibly with the
  // tool context in 0.9.2; verify the actual SDK instance instead of casting.
  assert.ok(value instanceof Thread);
  return value;
}
