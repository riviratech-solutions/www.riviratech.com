export type CourseOption = {
  name: string;
  slug: string;
};

export const COURSE_CATALOGUE: CourseOption[] = [
  { name: "AI For Kids",         slug: "/ai-for-kids" },
  { name: "AI For Coders",       slug: "/ai-for-coders" },
  { name: "AI For Non Coders",   slug: "/ai-for-non-coders" },
  { name: "GenAI For Business",  slug: "/genai-for-business" },
  { name: "AI Stack",            slug: "/ai-stack" },
  { name: "Corporate Training",  slug: "/corporate-training" },
];
