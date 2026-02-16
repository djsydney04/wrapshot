import posthog from "posthog-js";

// Track when user creates a project
export function trackProjectCreated(projectId: string, projectName: string) {
  posthog.capture("project_created", {
    project_id: projectId,
    project_name: projectName,
  });
}

// Track when user views a project
export function trackProjectViewed(projectId: string, projectName: string) {
  posthog.capture("project_viewed", {
    project_id: projectId,
    project_name: projectName,
  });
}

// Track when user uploads a script
export function trackScriptUploaded(projectId: string) {
  posthog.capture("script_uploaded", {
    project_id: projectId,
  });
}

// Track when user creates a scene
export function trackSceneCreated(projectId: string, sceneId: string) {
  posthog.capture("scene_created", {
    project_id: projectId,
    scene_id: sceneId,
  });
}

// Track when user creates a shooting day
export function trackShootingDayCreated(projectId: string, shootingDayId: string) {
  posthog.capture("shooting_day_created", {
    project_id: projectId,
    shooting_day_id: shootingDayId,
  });
}

// Track when user adds crew member
export function trackCrewAdded(projectId: string, role: string) {
  posthog.capture("crew_added", {
    project_id: projectId,
    role: role,
  });
}

// Track when user adds cast member
export function trackCastAdded(projectId: string) {
  posthog.capture("cast_added", {
    project_id: projectId,
  });
}

// Track budget actions
export function trackBudgetCreated(projectId: string, budgetId: string) {
  posthog.capture("budget_created", {
    project_id: projectId,
    budget_id: budgetId,
  });
}

export function trackExpenseAdded(budgetId: string, amount: number, category: string) {
  posthog.capture("expense_added", {
    budget_id: budgetId,
    amount: amount,
    category: category,
  });
}

// Track feature usage
export function trackFeatureUsed(feature: string, metadata?: Record<string, unknown>) {
  posthog.capture("feature_used", {
    feature: feature,
    ...metadata,
  });
}

// Track errors for debugging
export function trackError(error: string, context?: Record<string, unknown>) {
  posthog.capture("error_occurred", {
    error: error,
    ...context,
  });
}

// Track subscription events
export function trackSubscriptionStarted(plan: string) {
  posthog.capture("subscription_started", {
    plan: plan,
  });
}

export function trackSubscriptionCancelled(plan: string) {
  posthog.capture("subscription_cancelled", {
    plan: plan,
  });
}

// Track share actions
export function trackShareModalOpened() {
  posthog.capture("share_modal_opened");
}

export function trackShareLinkCopied() {
  posthog.capture("share_link_copied");
}

export function trackShareEmailSent(hasMessage: boolean) {
  posthog.capture("share_email_sent", {
    has_message: hasMessage,
  });
}
