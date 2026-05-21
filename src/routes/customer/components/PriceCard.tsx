interface PriceCardProps {
  name: string;
  price: string;
}

const PriceCard = ({ name, price }: PriceCardProps) => {
  return (
    <div className="flex justify-between items-center p-4 bg-brand-accent-light rounded-xl hover:shadow-lg hover:scale-105 transition-all border-2 border-transparent hover:border-brand-accent">
      <span className="font-semibold text-foreground">{name}</span>
      <span className="text-xl font-bold text-brand-accent">₦{price}</span>
    </div>
  );
};

export default PriceCard;
