import { Injectable } from "@nestjs/common";
import { NatsPublisher } from "@ain-rider/nats-client";
import {
  NATS_SUBJECTS,
  type DriverApprovedEvent,
} from "@ain-rider/shared-types";

@Injectable()
export class DriverEventPublisher {
  constructor(private readonly natsPublisher: NatsPublisher) { }

  async publishDriverApproved(
    data: DriverApprovedEvent["data"],
  ): Promise<void> {
    const event: DriverApprovedEvent = {
      type: "DRIVER_APPROVED",
      subject: NATS_SUBJECTS.DRIVER_APPROVED,
      data,
    };
    await this.natsPublisher.publish(event);
  }
}
