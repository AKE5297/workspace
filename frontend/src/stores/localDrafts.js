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
    if (data.id) {
      const idx = drafts.value.findIndex((d) => d.id === data.id);
      if (idx >= 0) {
        drafts.value[idx] = { ...drafts.value[idx], ...data, updatedAt: nowIso };
      } else {
        drafts.value.push({ id: data.id, ...data, createdAt: nowIso, updatedAt: nowIso });
      }
    } else {
      drafts.value.push({ id: `draft_${Date.now()}`, ...data, createdAt: nowIso, updatedAt: nowIso });
    }
    save(drafts.value);
    return drafts.value[drafts.value.length - 1];
  }

  function remove(id) {
    refresh();
    drafts.value = drafts.value.filter((d) => d.id !== id);
    save(drafts.value);
  }

  return { drafts, list, saveDraft, remove };
}
