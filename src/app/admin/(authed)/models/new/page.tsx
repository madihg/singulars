/**
 * /admin/models/new -> reuses /admin/models/[id] with id="new". This file is a
 * thin re-export so the URL is reachable without a dynamic-segment trick.
 */

export { default } from "../[id]/page";
