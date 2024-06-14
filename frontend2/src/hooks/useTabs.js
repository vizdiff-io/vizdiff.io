import { useState, useEffect } from 'react';

export default function useTabs(search, history, tabNames, currentPath) {
  useEffect(() => {
    const query = new URLSearchParams(search);
    const tab = query.get('tab');

    let selectedTab = tabNames.indexOf(tab);

    if (!tab) {
      selectedTab = 0;
    } else if (tab && selectedTab < 0) {
      selectedTab = 0;
      history.push(currentPath);
    }
    setCurrentTab(selectedTab);
  }, [search, history, tabNames, currentPath]);

  const [currentTab, setCurrentTab] = useState(0);

  const changeTab = (_, newValue) => {
    setCurrentTab(newValue);
    history.push(`${currentPath}?tab=${tabNames[newValue]}`);
  };

  return [currentTab, changeTab];
}
