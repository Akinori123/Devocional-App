const mockDevotionals = [
  { id: 'd1', theme: 'Ansiedade', title: 'Old Title' },
  { id: 'd2', theme: 'Gratidão', title: 'Test' }
];

const globalDevotionals = [
  { id: 'd1', theme: 'Ansiedade Editada', title: 'New Title' }
];

const allDevotionals = [
  ...globalDevotionals,
  ...mockDevotionals.filter(m => !globalDevotionals.some(g => g.id === m.id))
];

console.log(allDevotionals);
