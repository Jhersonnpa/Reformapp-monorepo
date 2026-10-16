import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.exists || branch.isDefault) {
      // Existing branches (incl. production): never reconcile here
      return {};
    }
    // New non-default branches: cheap + auto-expire (dev/preview/CI).
    // `neon checkout <name> --create` applies this on creation.
    return {
      ttl: "7d",
      postgres: {
        computeSettings: {
          autoscalingLimitMinCu: 0.25,
          autoscalingLimitMaxCu: 1,
          suspendTimeout: "5m",
        },
      },
    };
  },
});
