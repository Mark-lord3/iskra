import type { Request, Response } from "express";
import { getDatingAppConfig } from "../lib/feature-config";

export async function getPublicConfig(_req: Request, res: Response) {
  res.json(await getDatingAppConfig());
}
