import type { SourceContext } from "../api/contracts";
import {
  activitySource,
  petLibraryDialogue,
} from "../features/courses/activities";
import { material } from "./fixtures";

type ToolSample = {
  id: string;
  label: string;
  input: string;
  source: SourceContext;
};

export const toolSamples: ToolSample[] = [
  {
    id: "pdf-example-02",
    label: "数学 · 讲义例题 02",
    input: `解方程 ${material.exercise.equation}，并说明每一步的依据。`,
    source: {
      courseId: material.courseId,
      unitId: "equations",
      materialId: material.id,
      materialTitle: material.title,
      page: material.exercisePage,
      selectionId: material.exercise.id,
      selectionText: material.exercise.equation,
    },
  },
  {
    id: "science-plant-observation",
    label: "科学 · 植物与光",
    input:
      "两盆相同的植物得到同样的水和空气，一盆放在有光处，另一盆放在暗处。哪一盆更容易制造有机物？为什么？",
    source: {
      courseId: "science-7",
      unitId: "plants",
      activityId: "science-photosynthesis",
      activityTitle: "植物与光合作用",
      activityPrompt:
        "两盆相同的植物得到同样的水和空气，一盆放在有光处，另一盆放在暗处。哪一盆更容易制造有机物？为什么？",
    },
  },
  {
    id: petLibraryDialogue.id,
    label: "PET 英语 · 图书馆对话",
    input: `${petLibraryDialogue.passage}\n\n${petLibraryDialogue.prompt}`,
    source: activitySource("english-pet", "dialogue", petLibraryDialogue),
  },
];
