import React, {useState} from 'react';
import {ArrowUpRight, Copy, Check, Handshake} from 'lucide-react';
import tyLogo from '../../public/assets/ty-logo.png';

export function Partners() {
  const [copied,setCopied] = useState(false);
  const [message,setMessage] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText('RSHN'); setCopied(true); setMessage('Promo code copied.'); }
    catch { setMessage('Select and copy the code RSHN below.'); }
  };
  return <div className="partners-page">
    <section className="partner-intro"><Handshake size={28}/><h2>Our trading partner</h2><p>Explore TradersYard futures accounts and use our partner offer.</p></section>
    <section className="panel partner-card">
      <div className="partner-brand"><span className="connection-logo"><img src={tyLogo} alt="TradersYard"/></span><div><h2>TradersYard</h2><p>Futures prop trading</p></div></div>
      <p>Compare the available accounts, trading rules and pricing before choosing your plan.</p>
      <div className="partner-offer"><div><span className="subtle">Partner promo code</span><strong>RSHN</strong></div><button className="button" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>}Copy code</button></div>
      <p className="subtle">Enter RSHN at checkout for the available partner discount. Eligibility and the final discount are confirmed by TradersYard at checkout.</p>
      <a className="button primary" href="https://shop.tradersyard.com/ref/1486/" target="_blank" rel="noopener noreferrer sponsored">Explore TradersYard <ArrowUpRight size={18}/></a>
      <p className="micro">Affiliate link: Bulls & Bears may earn a commission when you purchase through this link.</p>
      <p role="status">{message}</p>
    </section>
    <section className="panel feefo-card" aria-label="Feefo product reviews">
      <div className="feefo-copy"><span className="feefo-name">Feefo</span><h2>TradersYard product reviews</h2><p>Customer feedback on Feefo.</p></div>
      <div className="feefo-rating"><div className="feefo-score"><strong>4.7</strong><span>/ 5</span></div><div className="rating-stars" role="img" aria-label="4.7 out of 5 stars"><span aria-hidden="true">★★★★★</span><span className="rating-fill" aria-hidden="true">★★★★★</span></div><small>Checked 28 Oct 2026</small></div>
      <a className="button" href="https://www.feefo.com/en-GB/reviews/tradersyard" target="_blank" rel="noopener noreferrer">Read Feefo reviews <ArrowUpRight size={16}/></a>
    </section>
  </div>;
}
