module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  maxWorkers: '50%',
};
