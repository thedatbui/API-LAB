export const errorHandler = (error, _req, res, _next) => {
    res.status(500).json({ error: error.message });
};
//# sourceMappingURL=errors.js.map