import { ref } from 'vue';

const STORAGE_KEY = 'wc_drafts';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function save(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

const drafts = ref(load());

export function useLocalDrafts() {
  function refresh() {
    drafts.value = load();
  }

  function list() {
    refresh();
    return drafts.value
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function saveDraft(data) {
    refresh();
    const nowIso = new Date().toISOString();
    let record;
    if (data.id) {
      const idx = drafts.value.findIndex((d) => d.id === data.id);
      if (idx >= 0) {
        drafts.value[idx] = { ...drafts.value[idx], ...data, updatedAt: nowIso };
        record = drafts.value[idx];
      } else {
        record = { id: data.id, ...data, createdAt: nowIso, updatedAt: nowIso };
        drafts.value.push(record);
      }
    } else {
      record = { id: `draft_${Date.now()}`, ...data, createdAt: nowIso, updatedAt: nowIso };
      drafts.value.push(record);
    }
    save(drafts.value);
    return record;
  }

  function remove(id) {
    refresh();
    drafts.value = drafts.value.filter((d) => d.id !== id);
    save(drafts.value);
  }

  return { drafts, list, saveDraft, remove };
}
