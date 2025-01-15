import { StackEntity } from "@hautechai/sdk";

export const getImageFromStack = (stack: StackEntity): string | undefined => {
  const finishedOperations = stack.operations.filter(
    (operation) => operation.status === "finished"
  );
  if (!finishedOperations.length) return undefined;

  const lastFinishedOperation =
    finishedOperations[finishedOperations.length - 1];

  const output = lastFinishedOperation.output;
  if (!output) return undefined;

  switch (output.kind) {
    case "image/multiple":
      return output.previewImageId;
    case "image/single":
      return output.imageId;
    default:
      return undefined;
  }
};
