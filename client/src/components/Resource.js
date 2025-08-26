import Link from "next/link";

export default function Resource({ title, description, link }) {
  return (
    <Link
      href={link}
      className="w-full block rounded-lg p-0 transition duration-200 ease-in-out hover:shadow-lg hover:scale-[1.01] h-full"
      aria-label={`Open resource ${title}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="backdrop-blur-sm bg-white/5 rounded-lg p-4 h-full flex flex-col justify-between">
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-white mb-1">
            {title}
          </h3>
          <p className="text-sm md:text-base text-gray-200/80">{description}</p>
        </div>
      </div>
    </Link>
  );
}
