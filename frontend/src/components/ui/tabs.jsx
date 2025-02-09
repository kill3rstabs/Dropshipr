import * as React from "react";

const TabsContext = React.createContext();

export function Tabs({ children, defaultValue }) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children }) {
  return <div className="tabs-list flex space-x-2">{children}</div>;
}

export function TabsTrigger({ value, children }) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);

  return (
    <button
      className={`tabs-trigger px-4 py-2 rounded ${
        activeTab === value ? "bg-blue-500 text-white" : "bg-gray-200"
      }`}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }) {
  const { activeTab } = React.useContext(TabsContext);

  return activeTab === value ? <div className="tabs-content">{children}</div> : null;
}