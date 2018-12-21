(function (window) {
  const tasks = document.querySelectorAll('.task');
  const groupNameElem = document.querySelector('.title__group-name');
  const taskNameElem = document.querySelector('.title__task-name');
  const statusTextElem = document.querySelector('.status__text');
  const targetElem = document.querySelector('.content');
  const taskRunner = document.querySelector('.task-control--runner');
  const taskShowData = document.querySelector('.task-control--data');
  let currentTask = {};

  tasks.forEach(task => {
    task.addEventListener('click', event => {
      event.preventDefault();
      statusTextElem.value = '';
      targetElem.innerHTML = '';
      statusTextElem.dataset.status = '';
      taskRunner.disabled = false;

      const taskId = task.dataset.taskid;
      const listId = task.dataset.listid;
      const groupTitle = task.dataset.grouptitle;
      const taskTitle = task.dataset.tasktitle;

      const data = {listId, taskId};
      const dataStr = JSON.stringify(data);
      currentTask = data;

      ws.send(dataStr);

      groupNameElem.innerHTML = groupTitle;
      taskNameElem.innerHTML = taskTitle;
    });
  });

  taskRunner.addEventListener('click', () => {
    taskRunner.disabled = true;

    const data = {action: 'stop-task'};
    const dataStr = JSON.stringify(data);
    ws.send(dataStr);
  });

  taskShowData.addEventListener('click', () => {
    const data = {
      action: 'show-data',
      payload: currentTask
    };
    const dataStr = JSON.stringify(data);
    ws.send(dataStr);
  });

  const initTabs = () => {
    const tabsRadioInputs = document.querySelectorAll('.tabs__radio');

    tabsRadioInputs.forEach(tabInput => {
      tabInput.addEventListener('click', () => {
        const data = {
          action: 'set-tab',
          payload: tabInput.id
        };
        const dataStr = JSON.stringify(data);
        ws.send(dataStr);
      });
    });
  };

  window.initTabs = initTabs;
}(window));
