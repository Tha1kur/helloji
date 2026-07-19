import httpStatus from "http-status";

/**
 * Validates `req.body` against a zod schema, replacing it with the parsed
 * result so handlers receive trimmed, correctly typed data.
 *
 * Keeping validation in middleware means each handler describes its shape
 * once, declaratively, instead of opening with a stack of `if (!x)` checks.
 */
export const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: result.error.issues[0].message,
            errors: result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    req.body = result.data;
    return next();
};
