import { useQueryState, parseAsString } from 'nuqs';

export function useSettingFilters() {
  const [category, setCategory] = useQueryState('category', parseAsString.withDefault('all'));

  const filters = { category: category === 'all' ? undefined : category };

  const clearFilters = () => {
    setCategory('all');
  };

  return { filters, category, setCategory, clearFilters };
}
