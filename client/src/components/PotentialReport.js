import Image from "next/image";

export default function PotentialReport({ url, address, addedAt }) {
  return (
    <div className="relative w-full mb-6">
      {/* Image container */}
      <div className="relative w-full h-64 md:h-80 lg:h-96">
        <Image
          src={url}
          alt={`Report from ${address}`}
          fill
          className="object-cover rounded-lg"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* Overlay with address and timestamp */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
          <div className="text-white">
            <p className="text-sm md:text-base font-medium mb-1">{address}</p>
            <p className="text-xs md:text-sm text-gray-200">{addedAt}</p>
          </div>
        </div>
      </div>


    </div>
  );
}
