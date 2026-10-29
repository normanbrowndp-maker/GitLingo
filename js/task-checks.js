window.GitLingo = window.GitLingo || {};

window.GitLingo.taskChecks = {
  option(task, selectedId) {
    return Boolean(task && task.options && task.options.some((option) => option.id === selectedId)
      && selectedId === task.answer);
  },
  outputReading(task, selectedId) {
    const selected = task && task.options && task.options.find((option) => option.id === selectedId);
    const canonical = (records) => Array.isArray(records)
      ? records.map((record) => `${record.path}\u0000${record.kind}`).sort().join("\u0001")
      : null;
    return Boolean(selected && canonical(selected.records) !== null && canonical(task.answer) !== null
      && canonical(selected.records) === canonical(task.answer));
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
