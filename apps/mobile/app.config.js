module.exports = ({ config }) => {
  const basePath = (process.env.EXPO_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
  if (!basePath) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl: basePath } };
};
