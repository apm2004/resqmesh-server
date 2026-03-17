/**
 * DeletedRedditId.ts
 * 
 * Tracks Reddit post IDs that have been manually deleted by the user.
 * The poller checks this collection at startup and at every poll cycle
 * to ensure deleted posts are never re-inserted into the database.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IDeletedRedditId extends Document {
    redditId: string;
    deletedAt: Date;
}

const DeletedRedditIdSchema = new Schema<IDeletedRedditId>({
    redditId:  { type: String, required: true, unique: true, index: true },
    deletedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IDeletedRedditId>('DeletedRedditId', DeletedRedditIdSchema);
