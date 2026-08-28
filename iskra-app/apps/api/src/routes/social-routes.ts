import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { blockConversation, decideProfile, discoverDeck, listConversations, listMessages, markConversationRead, reportConversation, sendMessage, undoPass, unmatchConversation } from "../controllers/social-controller";

export const socialRouter = Router();
socialRouter.use(requireAuth);
socialRouter.get("/discover/:eventId", discoverDeck);
socialRouter.post("/profiles/:profileId/decision", decideProfile);
socialRouter.delete("/profiles/:profileId/decision", undoPass);
socialRouter.get("/conversations/event/:eventId", listConversations);
socialRouter.get("/conversations/:conversationId/messages", listMessages);
socialRouter.post("/conversations/:conversationId/messages", sendMessage);
socialRouter.post("/conversations/:conversationId/read", markConversationRead);
socialRouter.post("/conversations/:conversationId/block", blockConversation);
socialRouter.post("/conversations/:conversationId/unmatch", unmatchConversation);
socialRouter.post("/conversations/:conversationId/report", reportConversation);
