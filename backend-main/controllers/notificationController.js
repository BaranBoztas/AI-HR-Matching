import { supabaseAdmin } from '../config/supabase.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Yetkisiz erişim.' });
    }

    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ notifications });
  } catch (error) {
    console.error('Bildirimleri Getirme Hatası:', error);
    return res.status(500).json({ error: 'Bildirimler getirilirken bir hata oluştu.' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Yetkisiz erişim.' });
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return res.status(200).json({ message: 'Bildirim okundu olarak işaretlendi.' });
  } catch (error) {
    console.error('Bildirim Güncelleme Hatası:', error);
    return res.status(500).json({ error: 'Bildirim güncellenirken bir hata oluştu.' });
  }
};
