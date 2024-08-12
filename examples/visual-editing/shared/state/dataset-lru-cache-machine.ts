/**
 * Synchronize a LRU Cache of a dataset with mendoza mutations.
 * It uses a long lived subscription to a `client.listen()` instance, and will apply patches to it as they come in.
 * If the LRU Cache starts evicting entries, then mendoza events will be ignored.
 * Special considerations:
 * - If a document exists initially, but then a mendonza event comes in that deletes it, then the cache entry for the document will be `null`.
 * - A document that initially exists, is deleted, might then be created again, so documents that are `null` need to handle document creations.
 * - Other machines might be writing to the same cache, so it's important to verify that the revision for the mendoza event isn't already applied before applying.
 * - When checking incoming mendoza events to see if they should be applied it's important to use cache methods that don't increase the LRU Cache's `used` count, as this machine is supposed to sync documents in the background and its activities are not an indication of wether the document is recently used or not.
 */
