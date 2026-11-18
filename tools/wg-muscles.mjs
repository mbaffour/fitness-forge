// workout-guide primaryMuscle/secondaryMuscles → our 12 muscle-group ids.
// Shared by import-workout-guide.mjs and import-exercise-meta.mjs: two copies
// of this table would drift, the way two copies of the weight model and the
// full_gym item list both did.
export const MUS = {
  Chest: 'chest', Shoulders: 'shoulders', 'Rear Delts': 'shoulders',
  'Upper Back': 'back', Back: 'back', Lats: 'back', 'Lower Back': 'back',
  Hamstrings: 'hamstrings', 'Posterior Chain': 'hamstrings',
  Quads: 'quads', Legs: 'quads', Adductors: 'quads', Groin: 'quads',
  Glutes: 'glutes', Hips: 'glutes', Calves: 'calves',
  Biceps: 'biceps', Triceps: 'triceps', Forearms: 'forearms', Core: 'core',
};
