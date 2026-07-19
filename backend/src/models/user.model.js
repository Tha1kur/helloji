import mongoose, { Schema } from "mongoose";

// One entry per active session, so signing in on a phone does not sign the
// user out on their laptop. Only the hash of each token is stored.
const refreshTokenSchema = new Schema(
    {
        hash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
    },
    { _id: false }
);

const userSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, trim: true },
        password: { type: String, required: true },
        refreshTokens: { type: [refreshTokenSchema], default: [] },
    },
    { timestamps: true }
);

// The password hash and session tokens should never reach a JSON response,
// even if a future handler returns a user document directly.
userSchema.set("toJSON", {
    transform: (_doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        return ret;
    },
});

const User = mongoose.model("User", userSchema);

export { User };
