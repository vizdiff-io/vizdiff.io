import { STRIPE_SECRET_KEY } from "./environment"

export const PRICE_IDS = STRIPE_SECRET_KEY?.startsWith("sk_live_")
  ? {
      // Production
      plan_starter_monthly: "price_1RD7APAHwipqjThpNXUCoh04",
      plan_starter_yearly: "price_1RD7APAHwipqjThpouoty3xp",
      plan_team_monthly: "price_1RD7APAHwipqjThpJ9A4BMbz",
      plan_team_yearly: "price_1RD7APAHwipqjThptvHyYtOm",
      plan_pro_monthly: "price_1RD7APAHwipqjThpQQsV8Z5e",
      plan_pro_yearly: "price_1RD7APAHwipqjThpeFyVzc9P",
      usage_screenshots_starter_monthly: "price_1RD7ALAHwipqjThpEcgUAvss",
      usage_screenshots_team_monthly: "price_1RD7ALAHwipqjThpKcRReZQ5",
      usage_screenshots_pro_monthly: "price_1RD7ALAHwipqjThp6D8zANri",
    }
  : {
      // Development
      plan_starter_monthly: "price_1RD6TpPJyeQKALgSGIRCFoq3",
      plan_starter_yearly: "price_1RD6bJPJyeQKALgSh7pg5Whz",
      plan_team_monthly: "price_1RD6ZePJyeQKALgSU2H3jFgV",
      plan_team_yearly: "price_1RD6bsPJyeQKALgSbrqBYgO5",
      plan_pro_monthly: "price_1RD6ZuPJyeQKALgS5uvgm9eG",
      plan_pro_yearly: "price_1RD6cSPJyeQKALgSwyiMbaPp",
      usage_screenshots_starter_monthly: "price_1RD6X2PJyeQKALgS9lGbfnRq",
      usage_screenshots_team_monthly: "price_1RD6drPJyeQKALgSr5lEKZDp",
      usage_screenshots_pro_monthly: "price_1RD6eQPJyeQKALgSjmpVdFfA",
    }
