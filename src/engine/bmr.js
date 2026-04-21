// ═══════════════════════════════════════════
//   FITNESS FORGE — BMR / TDEE / Macro Engine
//   Mifflin-St Jeor formula
// ═══════════════════════════════════════════

export const ACTIVITY_MULTIPLIERS = {
  sedentary:   { label: 'Sedentary',    desc: 'Desk job, little exercise', mult: 1.2  },
  light:       { label: 'Lightly Active', desc: '1–3 days/week exercise',  mult: 1.375 },
  moderate:    { label: 'Moderately Active', desc: '3–5 days/week exercise', mult: 1.55 },
  active:      { label: 'Very Active',  desc: '6–7 days/week hard exercise', mult: 1.725 },
  very_active: { label: 'Athlete',      desc: '2× per day training',       mult: 1.9  },
};

/**
 * Calculate Basal Metabolic Rate (Mifflin-St Jeor)
 * height in cm, weight in lbs, age in years, sex: 'male'|'female'
 */
export function calcBMR(profile) {
  const { height, age, sex, weight } = profile;
  if (!height || !age || !sex || !weight) return null;

  const kg = weight * 0.453592;
  const cm = height; // already in cm

  const base = (10 * kg) + (6.25 * cm) - (5 * age);
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

/**
 * Calculate Total Daily Energy Expenditure
 */
export function calcTDEE(bmr, activityLevel) {
  const mult = ACTIVITY_MULTIPLIERS[activityLevel]?.mult || 1.55;
  return bmr ? Math.round(bmr * mult) : null;
}

/**
 * Calculate macro targets from TDEE and goal
 * Returns { calories, protein, carbs, fat }
 */
export function calcMacros(tdee, goal, weightLbs) {
  if (!tdee) return null;

  // Calorie adjustment by goal
  const calMap = {
    build_muscle:    Math.round(tdee + 250),
    lose_fat:        Math.round(tdee - 400),
    get_stronger:    Math.round(tdee + 100),
    general_fitness: tdee,
    athletic:        Math.round(tdee + 200),
  };
  const calories = calMap[goal] || tdee;

  // Protein: 0.85g per lb bodyweight
  const protein = Math.round((weightLbs || 160) * 0.85);
  // Fat: 25-30% of calories
  const fat = Math.round(calories * 0.27 / 9);
  // Carbs: remainder
  const carbs = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 50);

  return { calories, protein, carbs, fat };
}

/**
 * Format height from cm to ft/in display
 */
export function cmToFtIn(cm) {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${ft}'${inches}"`;
}

/**
 * Convert ft and inches to cm
 */
export function ftInToCm(ft, inches) {
  return Math.round((ft * 12 + inches) * 2.54);
}
