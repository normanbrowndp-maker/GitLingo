window.MEGA = window.MEGA || {};

window.MEGA.taskChecks = {
  option(task, selectedId) {
    return Boolean(task && task.options && task.options.some((option) => option.id === selectedId)
      && selectedId === task.answer);
  },
  builder(task, selectedBlocks) {
    return Boolean(task && Array.isArray(task.answer) && Array.isArray(selectedBlocks)
      && selectedBlocks.length === task.answer.length
      && selectedBlocks.every((block, index) => block === task.answer[index]));
  },
  matchingPair(termIndex, definitionIndex) {
    return termIndex === definitionIndex;
  }
};
