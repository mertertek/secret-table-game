/**
 * D19 — menüdeki "Nasıl oynanır" sekmesi (çizim katmanı).
 *
 * NOT: dosya adı `HowToPlay.tsx` DEĞİL: macOS dosya sistemi büyük/küçük harf
 * duyarsız olduğu için `./HowToPlay` içe aktarımı veri modülü `howToPlay.ts`e
 * çözülüyordu. Bileşen adı `HowToPlay` olarak kaldı.
 *
 * İçerik `howToPlay.ts` içindedir (saf veri, kurallardan türetilir); burada
 * yalnız çizim var. Uzun metin telefonda kaydırılabilir: panel gövdesi
 * `game-menu__body` zaten `overflow-y: auto`, tablolar kendi içinde yatay
 * kaydırılır (sayfa gövdesi asla yatay taşmaz).
 */

import { useT } from '../i18n';
import { howToPlaySections, type HowToPlayBlock } from './howToPlay';
import { HowToPlayArt } from './howToPlayArt';

function Block({
  block,
  sectionId,
  index,
  playerCount,
}: {
  block: HowToPlayBlock;
  sectionId: string;
  index: number;
  playerCount?: number;
}) {
  switch (block.kind) {
    case 'text':
      return <p className="howto__text">{block.text}</p>;

    /**
     * D29 — bölüm görseli. `figure` + `figcaption`: ekran okuyucu altyazıyı
     * bağlamıyla okur, SVG'lerin kendi `aria-label`ları ayrıntıyı verir.
     */
    case 'art':
      return (
        <figure className="howto__figure" data-art={block.art}>
          <HowToPlayArt id={block.art} playerCount={playerCount} />
          <figcaption className="howto__figcaption">{block.caption}</figcaption>
        </figure>
      );

    case 'list':
      return (
        <ul className="howto__list">
          {block.items.map((item) => (
            <li key={item.slice(0, 40)}>{item}</li>
          ))}
        </ul>
      );

    case 'keys':
      return (
        <dl className="game-menu__keys howto__keys">
          {block.rows.map((row) => (
            <div key={`${row.keys}-${row.label}`} className="game-menu__key-row">
              <dt>
                <kbd>{row.keys}</kbd>
              </dt>
              <dd>{row.label}</dd>
            </div>
          ))}
        </dl>
      );

    case 'table': {
      const captionId = `howto-cap-${sectionId}-${index}`;
      return (
        <div className="howto__table-scroll">
          <table className="howto__table" aria-describedby={captionId}>
            <caption id={captionId} className="howto__caption">
              {block.caption}
            </caption>
            <thead>
              <tr>
                {block.head.map((cell) => (
                  <th key={cell} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, cellIndex) =>
                    cellIndex === 0 ? (
                      <th key={`${cell}-0`} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={`${cell}-${cellIndex}`}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * @param playerCount masadaki oyuncu sayısı (varsa). Tahta görseli açılışta bu
 *   sayının düzenini gösterir; oyuncu düzeni anahtardan yine değiştirebilir.
 */
export function HowToPlay({ playerCount }: { playerCount?: number } = {}) {
  const t = useT();
  return (
    <div className="howto">
      <p className="muted howto__intro">{t('howto.intro')}</p>
      {howToPlaySections().map((section) => (
        <section key={section.id} className="panel howto__section" aria-labelledby={`howto-${section.id}`}>
          <h3 id={`howto-${section.id}`} className="panel__title">
            {section.title}
          </h3>
          {section.blocks.map((block, index) => (
            <Block
              key={`${section.id}-${index}`}
              block={block}
              sectionId={section.id}
              index={index}
              playerCount={playerCount}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

export default HowToPlay;
