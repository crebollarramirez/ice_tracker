import { createContext, useContext, useState } from "react";

const DonateContext = createContext();

export const useDonate = () => {
  const context = useContext(DonateContext);
  if (!context) {
    throw new Error("useDonate must be used within a DonateProvider");
  }
  return context;
};

export const DonateProvider = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isNoticeVisible, setIsNoticeVisible] = useState(true);

  const showDonatePopup = () => {
    setIsVisible(true);
  };

  const hideDonatePopup = () => {
    setIsVisible(false);
  };

  const hideNotice = () => {
    setIsNoticeVisible(false);
  };

  return (
    <DonateContext.Provider
      value={{
        isVisible,
        showDonatePopup,
        hideDonatePopup,
        isNoticeVisible, 
        hideNotice,
      }}
    >
      {children}
    </DonateContext.Provider>
  );
};
