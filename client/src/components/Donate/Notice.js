import { useDonate } from "@/contexts/DonateContext";

export const Notice = () => {
  const {showDonatePopup, isNoticeVisible} = useDonate();

    if (!isNoticeVisible) return null;

  
  return (
    <div
      className="fixed bottom-4 right-4 bg-red-600 borde rounded-lg shadow-lg p-3 max-w-xs animate-bounce text-white/85 hover:bg-red-700 hover:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer mb-4 md:mb-0"
      onClick={() => {showDonatePopup() }}
    >
      <h3 className=" text-sm md:text-base font-semibold">
        Interested in Donating?
      </h3>
    </div>
  );
};
