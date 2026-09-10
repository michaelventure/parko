import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { createTicketSchema, ticketIdParamSchema } from "../schemas/ticketSchemas";
import { attachCheckoutSession, createTicket, getTicketById } from "../services/ticketService";
import { createCheckoutSessionForTicket } from "../services/stripeService";

export const ticketsRouter = Router();

ticketsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createTicketSchema.parse(req.body);
    const ticket = await createTicket(input.tenantSlug, input);
    res.status(201).json(ticket);
  })
);

ticketsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = ticketIdParamSchema.parse(req.params);
    const ticket = await getTicketById(id);
    res.status(200).json(ticket);
  })
);

ticketsRouter.post(
  "/:id/checkout-session",
  asyncHandler(async (req, res) => {
    const { id } = ticketIdParamSchema.parse(req.params);
    const ticket = await getTicketById(id);
    const session = await createCheckoutSessionForTicket(ticket);
    await attachCheckoutSession(ticket.id, session.id);
    res.status(201).json({ checkoutUrl: session.url, sessionId: session.id });
  })
);
