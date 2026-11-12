function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body ?? {},
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const details = result.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      }));
      const error = new Error(details.map((item) => `${item.field}: ${item.message}`).join('; '));
      error.status = 400;
      error.details = details;
      return next(error);
    }

    req.validated = result.data;
    next();
  };
}

module.exports = { validate };
